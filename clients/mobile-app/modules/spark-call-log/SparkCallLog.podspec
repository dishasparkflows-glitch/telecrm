Pod::Spec.new do |s|
  s.name           = 'SparkCallLog'
  s.version        = '1.0.0'
  s.summary        = 'SparkCRM call log platform bridge'
  s.description    = 'Android call-log bridge with an explicit unsupported iOS implementation.'
  s.author         = 'SparkCRM'
  s.homepage       = 'https://sparkcrm.io'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
end
